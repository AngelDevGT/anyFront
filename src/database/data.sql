INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getEstablishment','/getEstablishment','SELECT json_build_object(
    ''id'', e.id,
    ''name'', e."name",
    ''address'', e.address ,
    ''description'', e.description,
    ''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled,
    ''establishmentTypeId'', e.establishment_type_id,
    ''status'', json_build_object(
    	''id'', s.id,
        ''name'', s.name,
        ''identifier'', s.name,
        ''status'', s.status
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
    	''name'', u.username,
    	''email'', u.email
    ),
    ''creationDate'', e.creation_date,
    ''updatedDate'', coalesce(e.updated_date, e.creation_date)
) as json_result
FROM establishment e
LEFT JOIN status s ON s.id = e.status_id
left join "user" u on u.id = e.creator_user_id','establishment','POST'),
	 ('getProviderById','/getProvider','SELECT json_build_object(
        ''id'', p.id,
        ''name'', p.name,
        ''description'', p.description,
        ''email'', p.email,
        ''phone'', p.phone,
        ''company'', p.company,
        ''creationDate'', p.creation_date,
        ''updatedDate'', p.updated_date,
        ''status'', json_build_object(
        	''id'', s.id,
            ''identifier'', s.name,
            ''status'', s.status
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    ) as json_result
FROM provider p
LEFT JOIN status s ON s.id = p.status_id
LEFT JOIN "user" u ON u.id = p.creator_user_id','provider','POST'),
	 ('getAllProvidersByFilter','/retrieveProviders','SELECT json_agg(
    json_build_object(
        ''id'', p.id,
        ''name'', p.name,
        ''description'', p.description,
        ''email'', p.email,
        ''phone'', p.phone,
        ''company'', p.company,
        ''creationDate'', p.creation_date,
        ''updatedDate'', p.updated_date,
        ''status'', json_build_object(
        	''id'', s.id,
            ''identifier'', s.name,
            ''status'', s.status
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
) as json_result
FROM provider p
LEFT JOIN status s ON s.id = p.status_id
LEFT JOIN "user" u ON u.id = p.creator_user_id','provider','POST'),
	 ('getRoles','/getRoles','SELECT json_agg(
	json_build_object(
		''id'', id,
		''identifier'', name,
		''status'', status,
		''paths'', paths::jsonb
	)
) as json_result
from "role" r ','role','POST'),
	 ('getMeasure','/getMeasure','SELECT json_agg(
    json_build_object(
        ''id'', m.id,
        ''identifier'', m.name,
        ''name'', m.name,
        ''status'', m.status,
        ''unit_base_id'', m.unit_base_id,
        ''unitBase'', json_build_object(
            ''quantity'', m.unit_base_quantity,
            ''name'', ub.name,
            ''type'', ub."type"
        )
    )
) as json_result
FROM measure m
LEFT JOIN unit_base ub ON m.unit_base_id = ub.id','measure','POST'),
	 ('registerShop','/registerShop','call register_shop_sale_with_elements($1,$2,$3::uuid)','shop_sale','PATCH'),
	 ('getStatus','/getStatus','SELECT json_agg(
	json_build_object(
		''id'', id,
		''identifier'', "name" ,
		''status'', status,
		''name'', "name",
		''text'', id::text
	)
) as json_result
from status s','status','POST'),
	 ('retrieveUsers','/retrieveUsers','SELECT jsonb_agg(
    jsonb_build_object(
        ''id'', u.id,
        ''name'', u.username,
        ''email'', u.email,
        ''phone'', u.phone,
        ''role'', jsonb_build_object(
            ''id'', r.id,
            ''identifier'', r.name,
            ''status'', r.status
        ),
        ''status'', jsonb_build_object(
            ''id'', s.id,
            ''identifier'', s.name,
            ''type'', s."type"
        )
    )
) as json_result
from "user" u 
left join "role" r on u.role_id = r.id
left join "status" s on u.status_id = s.id','user','POST'),
	 ('updateProductForSaleStoreOrder','/updateProductForSaleStoreOrder','call update_product_for_sale_order_with_elements($1::uuid, $2, $3)','product_for_sale_store_order','PATCH'),
	 ('getUnitBase','/getUnitBase','SELECT json_agg(
	json_build_object(
		''id'', id,
		''identifier'', "name" ,
		''type'', "type" ,
		''name'', "name"
	)
) as json_result
from unit_base u','unit_base','POST');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getRawMaterial','/getRawMaterial','select json_build_object(
    ''id'', rm.id,
    ''rm_id'', rm.id,
    ''name'', rm.name,
    ''photo'', rm.photo,
    ''description'', rm.description,
    ''creationDate'', rm.creation_date,
    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
    ''measure'', json_build_object(
    	''id'', ub.id,
        ''identifier'', ub.name,
        ''type'', ub."type"
    ),
    ''status'', json_build_object(
    	''id'', s.id,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('getPaymentTypes','/getPaymentTypes','SELECT json_agg(
	json_build_object(
		''id'', id,
		''identifier'', "name" ,
		''status'', status,
		''name'', "name"
	)
) as json_result
from payment_type p','payment_type','POST'),
	 ('retrieveEstablishments','/retrieveEstablishments','with establishment_rcds as (
	select * from establishment e1
	order by e1.creation_date asc
)
SELECT json_agg(json_build_object(
    ''id'', e.id,
    ''name'', e."name",
    ''address'', e.address ,
    ''description'', e.description,
    ''receivePendingOrdersEnabled'', e.receive_pending_orders_enabled,
    ''establishmentTypeId'', e.establishment_type_id,
    ''status'', json_build_object(
    	''id'', s.id,
        ''name'', s.name,
        ''status'', s.status
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
    	''name'', u.username,
    	''email'', u.email
    )
)) as json_result
FROM establishment_rcds e
LEFT JOIN status s ON s.id = e.status_id
left join "user" u on u.id = e.creator_user_id ','establishment','POST'),
	 ('retrieveRawMaterial','/retrieveRawMaterial','SELECT json_agg(
    json_build_object(
        ''id'', rm.id,
        ''rm_id'', rm.id,
        ''name'', rm.name,
        ''photo'', rm.photo,
	    ''description'', rm.description,
	    ''creationDate'', rm.creation_date,
	    ''updatedDate'', coalesce(rm.updated_date, rm.creation_date),
        ''measure'', json_build_object(
        	''id'', ub.id,
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
) as json_result
FROM raw_material rm
LEFT JOIN unit_base ub ON ub.id = rm.unit_base_id
LEFT JOIN status s ON s.id = rm.status_id
LEFT JOIN "user" u ON u.id = rm.creator_user_id','raw_material','POST'),
	 ('getRawMaterialByProvider','/getRawMaterialByProvider','SELECT json_build_object(
        ''id'', rmbp.id,
    ''rawMaterialByProviderTypeId'', rmbp.raw_material_by_provider_type_id,
    ''price'', rmbp.price,
    ''creationDate'', rmbp.creation_date,
    ''updatedDate'', coalesce(rmbp.updated_date, rmbp.creation_date),
    ''rawMaterialBase'', json_build_object(
    	''id'', rm.id,
        ''name'', rm.name,
        ''description'', rm.description,
        ''photo'', rm.photo,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        )
    ),
    ''status'', json_build_object(
    	''id'', s.id,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    ),
    ''provider'', json_build_object(
    	''id'', p.id,
        ''name'', p.name,
        ''email'', p.email
    )
) as json_result
FROM raw_material_by_provider rmbp
LEFT JOIN raw_material rm ON rmbp.raw_material_base_id = rm.id
LEFT JOIN unit_base ub ON rm.unit_base_id = ub.id
LEFT JOIN provider p ON p.id = rmbp.provider_id
LEFT JOIN status s ON s.id = rmbp.status_id
LEFT JOIN "user" u ON u.id = rmbp.creator_user_id','raw_material_by_provider','POST'),
	 ('UpdateShopHistory','/UpdateShopHistory','update shop_sale
set name_client = $1, nit_client = $2, nota = $3, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $4','shop_sale','PATCH'),
	 ('retrieveRawMaterialOrder','/retrieveRawMaterialOrder','SELECT json_agg(
    json_build_object(
        ''id'', rmo.id,
        ''paidAmount'', rmo.paid_amount,
        ''finalAmount'', rmo.final_amount,
        ''pendingAmount'', rmo.pending_amount,
        ''status'', json_build_object(
            ''identifier'', s.name,
            ''id'', s.id
        ),
        ''paymentStatus'', json_build_object(
            ''identifier'', s2.name,
            ''id'', s2.id
        ),
        ''paymentType'', json_build_object(
            ''identifier'', pt.name,
            ''id'', pt.id
        ),
        ''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email,
            ''id'', u.id
        ),
        ''provider'', json_build_object(
            ''name'', p.name,
            ''id'', p.id
        ),
        ''rawMaterialOrderElements'', (
            SELECT json_agg(
                json_build_object(
                    ''id'', rmoe.id,
                    ''price'', rmoe.price,
                    ''discount'', rmoe.discount,
                    ''quantity'', rmoe.quantity,
                    ''subtotalPrice'', rmoe.subtotal_price,
                    ''totalDiscount'', rmoe.total_discount,
                    ''totalPrice'', rmoe.total_price,
                    ''rawMaterialByProvider'', json_build_object(
                        ''rawMaterialBase'', json_build_object(
                            ''name'', rm.name,
                            ''id'', rm.id
                        ),
                        ''provider'', json_build_object(
                            ''name'', p.name,
                            ''id'', p.id,
                            ''email'', p.email
                        )
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', m.name,
                        ''id'', m.id,
                        ''unitBase'', json_build_object(
                            ''quantity'', m.unit_base_quantity,
                            ''id'', m.unit_base_id
                        )
                    )
                )
            )
            FROM raw_material_order_element rmoe
            LEFT JOIN measure m ON m.id = rmoe.measure_id
            LEFT JOIN raw_material_by_provider rmbp ON rmbp.id = rmoe.raw_material_by_provider_id
            LEFT JOIN raw_material rm ON rm.id = rmbp.raw_material_base_id
            LEFT JOIN provider p ON rmbp.provider_id = p.id
            WHERE rmoe.raw_material_order_id = rmo.id
        ),
        ''rawMaterialOrderPayments'', (
            SELECT json_agg(
                json_build_object(
                    ''date'', rmop.date,
                    ''amount'', rmop.amount,
                    ''paymentType'', json_build_object(
                        ''name'', pt2.name,
                        ''id'', pt2.id
                    )
                )
            )
            FROM raw_material_order_payment rmop
            LEFT JOIN payment_type pt2 ON rmop.payment_type_id = pt2.id
            WHERE rmop.raw_material_order_id = rmo.id
        )
    )
)
FROM raw_material_order rmo
LEFT JOIN status s ON s.id = rmo.status_id
LEFT JOIN status s2 ON s2.id = rmo.payment_status_id
LEFT JOIN payment_type pt ON pt.id = rmo.payment_type_id
LEFT JOIN "user" u ON u.id = rmo.creator_user_id
LEFT JOIN provider p ON p.id = rmo.provider_id','raw_material_order','POST'),
	 ('retrieveRawMaterialByProvider','/retrieveRawMaterialByProvider','SELECT json_agg(
    json_build_object(
        ''id'', rmbp.id,
        ''rawMaterialByProviderTypeId'', rmbp.raw_material_by_provider_type_id,
        ''price'', rmbp.price,
        ''updatedDate'', coalesce(rmbp.updated_date, rmbp.creation_date),
        ''creationDate'', rmbp.creation_date,
        ''rawMaterialBase'', json_build_object(
        	''id'', rm.id,
            ''name'', rm.name,
            ''description'', rm.description,
            ''photo'', rm.photo,
            ''measure'', json_build_object(
                ''identifier'', ub.name,
                ''type'', ub."type"
            )
        ),
        ''status'', json_build_object(
        	''id'', s.id,
            ''identifier'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        ),
        ''provider'', json_build_object(
        	''id'', p.id,
            ''name'', p.name,
            ''email'', p.email
        )
    )
) as json_result
FROM raw_material_by_provider rmbp
LEFT JOIN raw_material rm ON rmbp.raw_material_base_id = rm.id
LEFT JOIN unit_base ub ON rm.unit_base_id = ub.id
LEFT JOIN provider p ON p.id = rmbp.provider_id
LEFT JOIN status s ON s.id = rmbp.status_id
LEFT JOIN "user" u ON u.id = rmbp.creator_user_id','raw_material_by_provider','POST'),
	 ('retrieveFinishedProduct','/retrieveFinishedProduct','SELECT json_agg(
    json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''description'', fp.description,
        ''photo'', fp.photo,
        ''creationDate'', fp.creation_date,
        ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
        ''finishedProductTypeId'', fp.finished_product_type_id,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        ),
        ''status'', json_build_object(
        	''id'', s.id,
        	''identifier'', s.name,
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''creatorUser'', json_build_object(
        	''id'', u.id,
            ''name'', u.username,
            ''email'', u.email
        )
    )
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST'),
	 ('getFinishedProduct','/getFinishedProduct','SELECT json_build_object(
    ''id'', fp.id,
    ''name'', fp.name,
    ''description'', fp.description,
    ''photo'', fp.photo,
    ''creationDate'', fp.creation_date,
    ''updatedDate'', coalesce(fp.updated_date, fp.creation_date),
    ''finishedProductTypeId'', fp.finished_product_type_id,
    ''measure'', json_build_object(
        ''identifier'', ub.name,
        ''type'', ub."type"
    ),
    ''status'', json_build_object(
    	''id'', s.id,
    	''identifier'', s.name,
        ''name'', s.name,
        ''type'', s."type"
    ),
    ''creatorUser'', json_build_object(
    	''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM finished_product fp
LEFT JOIN unit_base ub ON ub.id = fp.unit_base_id
LEFT JOIN status s ON s.id = fp.status_id
LEFT JOIN "user" u ON u.id = fp.creator_user_id','finished_product','POST');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('cancelShopHistory','/cancelShopHistory','call cancel_shop_sale($1::uuid, $2::uuid)','shop_sale','PATCH'),
	 ('listRawMaterialOrder','/listRawMaterialOrder','SELECT json_agg(
    json_build_object(
        ''id'', rmo.id,
        ''paidAmount'', rmo.paid_amount,
        ''finalAmount'', rmo.final_amount,
        ''pendingAmount'', rmo.pending_amount,
        ''name'', rmo."name",
        ''description'', rmo.description,
        ''creationDate'', rmo.creation_date,
        ''updatedDate'', coalesce(rmo.updated_date, rmo.creation_date),
        ''status'', json_build_object(
            ''identifier'', s.name,
            ''id'', s.id
        ),
        ''paymentStatus'', json_build_object(
            ''identifier'', s2.name,
            ''id'', s2.id
        ),
        ''paymentType'', json_build_object(
            ''identifier'', pt.name,
            ''id'', pt.id
        ),
        ''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email,
            ''id'', u.id
        ),
        ''provider'', json_build_object(
            ''name'', p.name,
            ''id'', p.id
        )
    )
) AS json_result
FROM raw_material_order rmo
LEFT JOIN status s ON s.id = rmo.status_id
LEFT JOIN status s2 ON s2.id = rmo.payment_status_id
LEFT JOIN payment_type pt ON pt.id = rmo.payment_type_id
LEFT JOIN "user" u ON u.id = rmo.creator_user_id
LEFT JOIN provider p ON p.id = rmo.provider_id','raw_material_order','POST'),
	 ('retrieveFinishedProductInventory','/retrieveFinishedProductInventory','SELECT json_build_object(
    ''id'', i.id,
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''creationDate'', ie.creation_date,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''finishedProduct'', json_build_object(
                    ''id'', fp.id,
                    ''name'', fp.name,
                    ''photo'', fp.photo,
                    ''finishedProductTypeId'', fp.finished_product_type_id,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub2.name
                    )
                )
            )
            ORDER BY fp.creation_date
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON sie.id = ie.status_id
        LEFT JOIN measure m ON m.id = ie.measure_id
        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
        left JOIN finished_product fp ON fp.id = ie.element_fk
        left join unit_base ub2 on ub2.id = fp.unit_base_id 
        LEFT JOIN status srm ON srm.id = fp.status_id
        WHERE ie.element_type = ''finished_product''
          AND ie.inventory_id = i.id
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''finished_product''','inventory','POST'),
	 ('tempGetNewStoreCashClosing','/tempGetNewStoreCashClosing','SELECT json_build_object(
	''lastInventoryCreationDate'', (select max(creation_date) from cash_closing cc1 where cc1.status_id = 55 and cc1.establishment_id = e.id),
	''establishment'', json_build_object(
		''id'', e.id,
		''name'', e."name"
	),
	''saleStoreOrders'', (
		SELECT json_agg(
		    json_build_object(
		        ''id'', pfsso.id,
		        ''name'', pfsso.name,
		        ''comment'', pfsso.comment,
		        ''finalAmount'', pfsso.final_amount,
		        ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
		        ''creationDate'', pfsso.creation_date,
		        ''storeStatus'', json_build_object(
		            ''identifier'', s.name,
		            ''id'', s.id
		        ),
		        ''factoryStatus'', json_build_object(
		            ''identifier'', s2.name,
		            ''id'', s2.id
		        ),
		        ''creatorUser'', json_build_object(
		            ''name'', u.username,
		            ''email'', u.email,
		            ''id'', u.id
		        )
		    )
		) AS json_result
		from product_for_sale_store_order pfsso 
		left join establishment e2 on e2.id = pfsso.establishment_id
		left join status s on s.id = pfsso.store_status_id
		left join status s2 on s2.id = pfsso.factory_status_id
		left join "user" u on u.id = pfsso.creator_user_id
		where e.id = pfsso.establishment_id
	),
	''shopResumes'', (
		SELECT json_agg(
		    json_build_object(
		        ''id'', ss.id,
			    ''nameClient'', ss.name_client,
			    ''nitClient'', ss.nit_client,
			    ''nota'', ss.nota,
			    ''total'', ss.total,
			    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
			    ''creationDate'', ss.creation_date,
			    ''status'', json_build_object(
			        ''identifier'', s.name,
			        ''id'', s.id
			    ),
			    ''itemsList'', (
				    SELECT json_agg(
					    json_build_object(
					    	''id'', sse.id,
					    	''productForSale'', json_build_object(
						        ''id'', pfs.id,
						        ''finishedProduct'', json_build_object(
						            ''id'', fp.id,
						            ''name'', fp.name
						        )
							)
					    )
					)
					from shop_sale_element sse
					left join product_for_sale pfs on pfs.id = sse.product_for_sale_id 
					LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
					LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
					left join measure m2 on sse.measure_id = m2.id
					WHERE sse.shop_sale_id = ss.id
				)
		    )
		) AS json_result
		from shop_sale ss 
		left join status s on ss.status_id = s.id
		left join payment_type pt on ss.payment_type_id = pt.id
		left join "user" u on ss.creator_user_id = u.id
		left join establishment e3 on ss.establishment_id = e3.id
		where e.id = ss.establishment_id
	),
	''inventoryCapture'', (
		SELECT json_build_object(
		    ''inventory_id'', i.id,
		    ''inventory_type'', i.inventory_type,
		    ''unit_name'', i.unit_name,
		    ''creator_user_id'', i.creator_user_id,
		    ''status_id'', i.status_id,
		    ''creation_date'', i.creation_date,
		    ''inventoryElements'', (
		        SELECT json_agg(
		            json_build_object(
		                ''id'', ie.id,
		                ''element_type'', ie.element_type,
		                ''quantity'', ie.quantity,
		                ''status'', json_build_object(
		                    ''identifier'', sie.name,
		                    ''id'', sie.id
		                ),
		                ''measure'', json_build_object(
		                    ''id'', m.id,
		                    ''identifier'', m.name,
		                    ''unitBase'', json_build_object(
		                        ''quantity'', m.unit_base_quantity,
		                        ''name'', ub.name,
		                        ''id'', ub.id
		                    )
		                ),
		                ''productForSale'', json_build_object(
		                	''id'', pfs.id,
		                	''price'', pfs.price,
			                ''finishedProduct'', json_build_object(
			                    ''id'', fp.id,
			                    ''name'', fp.name,
			                    ''photo'', fp.photo,
			                    ''status'', json_build_object(
			                        ''id'', srm.id,
			                        ''identifier'', srm.name
			                    )
			                )
		                )
		            )
		        )
		        FROM inventory_element ie
		        join product_for_sale pfs on ie.element_fk = pfs.id
		        left JOIN finished_product fp ON fp.id = pfs.finished_product_id
		        LEFT JOIN status sie ON sie.id = ie.status_id
		        LEFT JOIN measure m ON m.id = ie.measure_id
		        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
		        LEFT JOIN status srm ON srm.id = fp.status_id
		        WHERE ie.element_type = ''product_for_sale''
		          AND ie.inventory_id = i.id
		    )
		) AS json_result
		FROM inventory i
		WHERE i.inventory_type = ''product_for_sale'' and i.unit_name = e.id::text
		LIMIT 1
	),
	''inventoryElementActions'', (
		SELECT json_agg(
		    json_build_object(
		    	''id'', iea.id,
		    	''creationDate'', iea.creation_date,
		    	''reason'', iea."comment",
		    	''element'', json_build_object(
		    		''name'', fp3."name"
		    	),
		    	''measure'', json_build_object(
		            ''identifier'', m3.name,
		            ''unitBase'', json_build_object(
		                ''quantity'', m3.unit_base_quantity
		            )
		        ),
		    	''quantity'', iea.quantity,
		    	''creatorUser'', json_build_object(
		            ''name'', u3.username,
		            ''email'', u3.email
		        ),
		        ''actionType'', json_build_object(
		        	''color'', at.color,
		        	''action'', at.action,
		            ''name'', at."name"
		        )
		    )
		) as json_result
		from inventory_element_action iea
		left join inventory_element ie3 on ie3.id = iea.source_inventory_element_id
		left join inventory i3 on i3.id = ie3.inventory_id
		left join measure m3 on m3.id = iea.measure_id 
		left join "user" u3 on u3.id = iea.creator_user_id
		left join action_type at on at.id = iea.action_type_id 
		join product_for_sale pfs3 on ie3.element_fk = pfs3.id
		left JOIN finished_product fp3 ON fp3.id = pfs3.finished_product_id
		where i3.unit_name = e.id::text
	)
) as json_result
from establishment e ','cash_closing','POST'),
	 ('getNewStoreCashClosing','/getNewStoreCashClosing','SELECT json_build_object(
	''lastInventoryCreationDate'', (select max(creation_date) from cash_closing cc1 where cc1.status_id in (55,57) and cc1.establishment_id = e.id),
	''establishment'', json_build_object(
		''id'', e.id,
		''name'', e."name"
	),
	''saleStoreOrders'', (
		SELECT json_agg(
		    json_build_object(
		        ''id'', pfsso.id,
		        ''name'', pfsso.name,
		        ''comment'', pfsso.comment,
		        ''finalAmount'', pfsso.final_amount,
		        ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
		        ''creationDate'', pfsso.creation_date,
		        ''storeStatus'', json_build_object(
		            ''identifier'', s.name,
		            ''id'', s.id
		        ),
		        ''factoryStatus'', json_build_object(
		            ''identifier'', s2.name,
		            ''id'', s2.id
		        ),
		        ''creatorUser'', json_build_object(
		            ''name'', u.username,
		            ''email'', u.email,
		            ''id'', u.id
		        ),
		        ''productForSaleStoreOrderElements'', (
				    SELECT json_agg(
					    json_build_object(
					    	''id'', pfssoe.id,
					    	''price'', pfssoe.price,
					    	''quantity'', pfssoe.quantity,
					    	''totalPrice'', pfssoe.total_price,
					    	''date'', pfssoe."date",
					    	''measure'', json_build_object(
					    		''identifier'', m1.name,
					    		''id'', m1.id
					    	),
					        ''productForSale'', json_build_object(
					        	''id'', pfs.id,
						        ''creationDate'', pfs.creation_date,
							    ''updatedDate'', pfs.updated_date,
						        ''price'', pfs.price,
						        ''finishedProduct'', json_build_object(
						            ''id'', fp.id,
						            ''name'', fp.name,
						            ''photo'', fp.photo,
						            ''description'', fp.description
						        )
					        )
					    )
					)
					from product_for_sale_store_order_element pfssoe
					LEFT JOIN measure m1 on m1.id = pfssoe.measure_id
					left join product_for_sale pfs on pfs.id = pfssoe.product_for_sale_id
					LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
					LEFT JOIN establishment e3 ON e3.id = pfs.establishment_id
					LEFT JOIN status s3 ON s3.id = pfs.status_id
					WHERE pfssoe.pfsso_id = pfsso.id
				)
		    )
		) AS json_result
		from product_for_sale_store_order pfsso 
		left join establishment e2 on e2.id = pfsso.establishment_id
		left join status s on s.id = pfsso.store_status_id
		left join status s2 on s2.id = pfsso.factory_status_id
		left join "user" u on u.id = pfsso.creator_user_id
		where e.id = pfsso.establishment_id
		and ((select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id) IS NULL OR pfsso.creation_date >= (select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id)) 
	),
	''shopResumes'', (
		SELECT json_agg(
		    json_build_object(
		        ''id'', ss.id,
			    ''nameClient'', ss.name_client,
			    ''nitClient'', ss.nit_client,
			    ''nota'', ss.nota,
			    ''total'', ss.total,
			    ''totalDiscount'', ss.total_discount,
			    ''delivery'', ss.delivery,
			    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
			    ''creationDate'', ss.creation_date,
			    ''status'', json_build_object(
			        ''identifier'', s.name,
			        ''id'', s.id
			    ),
			    ''itemsList'', (
				    SELECT json_agg(
					    json_build_object(
					    	''id'', sse.id,
					    	''quantity'', sse.quantity,
					    	''price'', sse.price,
					    	''totalDiscount'', sse.total_discount,
					    	''total'', sse.total,
					    	''productForSale'', json_build_object(
						        ''id'', pfs.id,
						        ''finishedProduct'', json_build_object(
						            ''id'', fp.id,
						            ''name'', fp.name
						        )
							),
							''measure'', json_build_object(
								''identifier'', m2."name",
								''id'', m2.id
							)
					    )
					)
					from shop_sale_element sse
					left join product_for_sale pfs on pfs.id = sse.product_for_sale_id 
					LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
					left join measure m2 on sse.measure_id = m2.id
					WHERE sse.shop_sale_id = ss.id
				)
		    )
		) AS json_result
		from shop_sale ss 
		left join status s on ss.status_id = s.id
		left join payment_type pt on ss.payment_type_id = pt.id
		left join "user" u on ss.creator_user_id = u.id
		left join establishment e3 on ss.establishment_id = e3.id
		where e.id = ss.establishment_id
		and ss.status_id = 52
		and ((select max(creation_date) from cash_closing cc1 where  cc1.establishment_id = e.id) IS NULL OR ss.creation_date >= (select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id))
	),
	''lastInventory'', (select inventory_capture from cash_closing where establishment_id = e.id order by creation_date desc limit 1),
	''inventoryCapture'', (
		SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''productForSale'', json_build_object(
                	''id'', pfs.id,
                	''price'', pfs.price,
	                ''finishedProduct'', json_build_object(
	                    ''id'', fp.id,
	                    ''name'', fp.name,
	                    ''photo'', fp.photo,
	                    ''status'', json_build_object(
	                        ''id'', srm.id,
	                        ''identifier'', srm.name
	                    )
	                )
                )
            )
        )
        FROM inventory i1
        join inventory_element ie on i1.id = ie.inventory_id
        join product_for_sale pfs on ie.element_fk = pfs.id
        left JOIN finished_product fp ON fp.id = pfs.finished_product_id
        LEFT JOIN status sie ON sie.id = ie.status_id
        LEFT JOIN measure m ON m.id = ie.measure_id
        LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
        LEFT JOIN status srm ON srm.id = fp.status_id
        WHERE ie.element_type = ''product_for_sale''
          and i1.unit_name = e.id::text
	),
	''inventoryElementActions'', (
		SELECT json_agg(
		    json_build_object(
		    	''id'', iea.id,
		    	''creationDate'', iea.creation_date,
		    	''reason'', iea."comment",
		    	''element'', json_build_object(
		    		''name'', fp3."name"
		    	),
		    	''price'', pfs3.price,
		    	''measure'', json_build_object(
		            ''identifier'', m3.name,
		            ''unitBase'', json_build_object(
		                ''quantity'', m3.unit_base_quantity
		            )
		        ),
		    	''quantity'', iea.quantity,
		    	''creatorUser'', json_build_object(
		            ''name'', u3.username,
		            ''email'', u3.email
		        ),
		        ''actionType'', json_build_object(
		        	''color'', at.color,
		        	''action'', at.action,
		        	''type'', at.type,
		            ''name'', at."name"
		        )
		    )
		) as json_result
		from inventory_element_action iea
		left join inventory_element ie3 on ie3.id = iea.source_inventory_element_id
		left join inventory i3 on i3.id = ie3.inventory_id
		left join measure m3 on m3.id = iea.measure_id 
		left join "user" u3 on u3.id = iea.creator_user_id
		left join action_type at on at.id = iea.action_type_id 
		join product_for_sale pfs3 on ie3.element_fk = pfs3.id
		left JOIN finished_product fp3 ON fp3.id = pfs3.finished_product_id
		where i3.unit_name = e.id::text
		and ((select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id) IS NULL OR iea.creation_date >= (select max(creation_date) from cash_closing cc1 where cc1.establishment_id = e.id))
	)
) as json_result
from establishment e ','cash_closing','POST'),
	 ('listStoreCashClosing','/listStoreCashClosing','SELECT json_agg(json_build_object(
	''id'', cc.id,
	''creationDate'', cc.creation_date, 
	''note'', cc.note,
	''userRequest'', json_build_object(
		''name'', u.username
	),
	''status'', json_build_object(
		''identifier'', s."name" 
	)
)) as json_result
from cash_closing cc
left join "user" u on u.id = cc.validator_user
left join status s on s.id = cc.status_id','cash_closing','POST'),
	 ('getShopSale','/getShopSale','select json_build_object(
    ''id'', ss.id,
    ''nameClient'', ss.name_client,
    ''nitClient'', ss.nit_client,
    ''nota'', ss.nota,
    ''total'', ss.total,
    ''totalDiscount'', ss.total_discount,
    ''delivery'', ss.delivery,
    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
    ''creationDate'', ss.creation_date,
    ''status'', json_build_object(
        ''identifier'', s.name,
        ''id'', s.id
    ),
    ''creatorUser'', json_build_object(
        ''name'', u.username,
        ''email'', u.email,
        ''id'', u.id
    ),
    ''establishment'', json_build_object(
        ''identifier'', e."name",
        ''id'', e.id,
        ''address'', e.address
    ),
    ''itemsList'', (
	    SELECT json_agg(
		    json_build_object(
		    	''id'', sse.id,
		    	''quantity'', sse.quantity,
		    	''discount'', sse.discount,
		    	''price'', sse.price,
		    	''subtotal'', sse.subtotal,
		    	''totalDiscount'', sse.total_discount,
		    	''total'', sse.total,
		    	''measure'', json_build_object(
		    		''id'', m2.id,
		    		''identifier'', m2.name
		    	),
		    	''productForSale'', json_build_object(
			        ''id'', pfs.id,
			        ''creationDate'', pfs.creation_date,
				    ''updatedDate'', pfs.updated_date,
			        ''price'', pfs.price,
			        ''finishedProduct'', json_build_object(
			            ''id'', fp.id,
			            ''name'', fp.name,
			            ''identifier'', fp.name,
			            ''photo'', fp.photo,
			            ''description'', fp.description,
			            ''measure'', json_build_object(
			                ''identifier'', ub.name,
			                ''type'', ub."type"
			            )
			        )
				)
		    )
		)
		from shop_sale_element sse
		left join product_for_sale pfs on pfs.id = sse.product_for_sale_id 
		LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
		LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
		left join measure m2 on sse.measure_id = m2.id
		WHERE sse.shop_sale_id = ss.id
	)
) as json_result
from shop_sale ss 
left join status s on ss.status_id = s.id
left join payment_type pt on ss.payment_type_id = pt.id
left join "user" u on ss.creator_user_id = u.id
left join establishment e on ss.establishment_id = e.id','shop_sale','POST'),
	 ('retrieveProductsForSale','/retrieveProductsForSale','SELECT json_agg(
    json_build_object(
        ''id'', pfs.id,
        ''creationDate'', pfs.creation_date,
	    ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
        ''price'', pfs.price,
        ''finishedProduct'', json_build_object(
            ''id'', fp.id,
            ''name'', fp.name,
            ''photo'', fp.photo,
            ''description'', fp.description,
            ''measure'', json_build_object(
                ''identifier'', ub.name,
                ''type'', ub."type"
            )
        ),
        ''status'', json_build_object(
            ''name'', s.name,
            ''type'', s."type"
        ),
        ''establishment'', json_build_object(
            ''id'', e.id,
            ''name'', e.name
        )
    )
) AS json_result
FROM product_for_sale pfs
LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
LEFT JOIN establishment e ON e.id = pfs.establishment_id
LEFT JOIN status s ON s.id = pfs.status_id','product_for_sale','POST'),
	 ('deleteStoreCashClosing','/deleteStoreCashClosing','delete from cash_closing
where id = $1','cash_closing','PATCH'),
	 ('retrieveStoreCashClosing','/retrieveStoreCashClosing','SELECT json_build_object(
	''id'', cc.id,
	''creationDate'', cc.creation_date, 
	''note'', cc.note,
	''userRequest'', json_build_object(
		''name'', u.username,
		''email'', u.email
	),
	''userValidator'', json_build_object(
		''name'', u2.username,
		''email'', u2.email
	),
	''status'', json_build_object(
		''id'', s.id,
		''identifier'', s."name" 
	),
	''establishment'', cc.establishment_id,
	''saleStoreOrders'', cc.sale_store_orders,
	''shopResumes'', cc.shop_sales,
	''lastInventory'', cc.last_inventory_capture,
	''lastInventoryCreationDate'', cc.last_inventory_creation_date,
	''inventoryCapture'', cc.inventory_capture,
	''inventoryElementActions'', cc.inventory_element_actions
) as json_result
from cash_closing cc
left join "user" u on u.id = cc.validator_user
left join "user" u2 on u2.id = cc.confirm_user
left join status s on s.id = cc.status_id','cash_closing','POST');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getProductForSale','/getProductForSale','SELECT json_build_object(
    ''id'', pfs.id,
    ''price'', pfs.price,
    ''creationDate'', pfs.creation_date,
    ''updatedDate'', coalesce(pfs.updated_date, pfs.creation_date),
    ''finishedProduct'', json_build_object(
        ''id'', fp.id,
        ''name'', fp.name,
        ''photo'', fp.photo,
        ''description'', fp.description,
        ''measure'', json_build_object(
            ''identifier'', ub.name,
            ''type'', ub."type"
        )
    ),
    ''status'', json_build_object(
        ''name'', s.name,
        ''identifier'', s.name,
        ''type'', s."type"
    ),
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e.name
    ),
    ''creatorUser'', json_build_object(
        ''id'', u.id,
        ''name'', u.username,
        ''email'', u.email
    )
) as json_result
FROM product_for_sale pfs
LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
LEFT JOIN establishment e ON e.id = pfs.establishment_id
LEFT JOIN status s ON s.id = pfs.status_id
left join "user" u on u.id = pfs.creator_user_id','product_for_sale','POST'),
	 ('verifyCashClosing','/verifyCashClosing','call verify_cash_closing($1::uuid, $2::uuid)','cash_closing','PATCH'),
	 ('addStoreCashClosing','/addStoreCashClosing','call register_cash_closing($1, $2::uuid, $3::uuid)','cash_closing','PATCH'),
	 ('updateStoreCashClosing','/updateStoreCashClosing','update cash_closing
set updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP), note = $1
where id = $2','cash_closing','PATCH'),
	 ('registerUser','/registerUser','INSERT INTO "user"
(external_id, username, status_id, email, role_id)
VALUES($1, $2, 6, $3, $4)','user','PATCH'),
	 ('updateUser','/updateUser','update "user"
set username = $1, phone = $2, status_id = $3, role_id = $4
where id = $5::uuid','user','PATCH'),
	 ('retrieveRawMaterialInventory','/retrieveRawMaterialInventory','SELECT json_build_object(
    ''id'', i.id,
    ''name'', i."name",
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''updatedDate'', i.updated_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''rawMaterialBase'', json_build_object(
                    ''id'', rm.id,
                    ''name'', rm.name,
                    ''photo'', rm.photo,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub.name
                    )
                )
            )
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON ie.status_id = sie.id
        LEFT JOIN measure m ON ie.measure_id = m.id
        LEFT JOIN unit_base ub ON m.unit_base_id = ub.id
        JOIN raw_material rm ON ie.element_fk = rm.id
        left join unit_base ub2 on ub2.id = rm.unit_base_id 
        LEFT JOIN status srm ON srm.id = rm.status_id
        WHERE ie.element_type = ''raw_material''
          AND ie.inventory_id = i.id
    )
) as json_result
FROM inventory i
where i.inventory_type = ''raw_material''','inventory','POST'),
	 ('retrievePackagingMaterialInventory','/retrievePackagingMaterialInventory','SELECT json_build_object(
    ''id'', i.id,
    ''name'', i."name",
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''updatedDate'', i.updated_date,
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', ie.id,
                ''element_type'', ie.element_type,
                ''quantity'', ie.quantity,
                ''status'', json_build_object(
                    ''identifier'', sie.name,
                    ''id'', sie.id
                ),
                ''measure'', json_build_object(
                    ''id'', m.id,
                    ''identifier'', m.name,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''name'', ub.name,
                        ''id'', ub.id
                    )
                ),
                ''rawMaterialBase'', json_build_object(
                    ''id'', rm.id,
                    ''name'', rm.name,
                    ''photo'', rm.photo,
                    ''status'', json_build_object(
                        ''id'', srm.id,
                        ''identifier'', srm.name
                    ),
                    ''measure'', json_build_object(
                        ''identifier'', ub.name
                    )
                )
            )
        )
        FROM inventory_element ie
        LEFT JOIN status sie ON ie.status_id = sie.id
        LEFT JOIN measure m ON ie.measure_id = m.id
        LEFT JOIN unit_base ub ON m.unit_base_id = ub.id
        JOIN raw_material rm ON ie.element_fk = rm.id
        LEFT JOIN unit_base ub2 ON ub2.id = rm.unit_base_id
        LEFT JOIN status srm ON srm.id = rm.status_id
        WHERE ie.element_type = ''packaging_material''
          AND ie.inventory_id = i.id
    )
) AS json_result
FROM inventory i
WHERE i.inventory_type = ''packaging_material''','inventory','POST'),
	 ('listShopSale','/listShopSale','SELECT json_agg(
    json_build_object(
        ''id'', ss.id,
	    ''nameClient'', ss.name_client,
	    ''nitClient'', ss.nit_client,
	    ''nota'', ss.nota,
	    ''total'', ss.total,
	    ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
	    ''creationDate'', ss.creation_date,
	    ''status'', json_build_object(
	        ''identifier'', s.name,
	        ''id'', s.id,
	        ''bg_color'', s.bg_color,
	        ''color'', s.color
	    ),
	    ''itemsList'', (
		    SELECT json_agg(
			    json_build_object(
			    	''id'', sse.id,
			    	''productForSale'', json_build_object(
				        ''id'', pfs.id,
				        ''finishedProduct'', json_build_object(
				            ''id'', fp.id,
				            ''name'', fp.name
				        )
					)
			    )
			)
			from shop_sale_element sse
			left join product_for_sale pfs on pfs.id = sse.product_for_sale_id
			LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
			LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
			left join measure m2 on sse.measure_id = m2.id
			WHERE sse.shop_sale_id = ss.id
		)
    )
) AS json_result
from shop_sale ss
left join status s on ss.status_id = s.id
left join payment_type pt on ss.payment_type_id = pt.id
left join "user" u on ss.creator_user_id = u.id
left join establishment e on ss.establishment_id = e.id','shop_sale','POST'),
	 ('listShopSaleSummary','/listShopSaleSummary','SELECT json_agg(
    json_build_object(
        ''id'', ss.id,
        ''total'', ss.total,
        ''totalDiscount'', ss.total_discount,
        ''updatedDate'', coalesce(ss.updated_date, ss.creation_date),
        ''status'', json_build_object(''id'', s.id),
        ''establishment'', json_build_object(
            ''id'', e.id,
            ''name'', e.name
        )
    )
) AS json_result
from shop_sale ss
left join status s on ss.status_id = s.id
left join establishment e on ss.establishment_id = e.id','shop_sale','POST'),
	 ('deleteProductForSaleStoreOrder','/deleteProductForSaleStoreOrder','update product_for_sale_store_order 
set store_status_id = 24, factory_status_id = 24
where id = $1','product_for_sale_store_order','PATCH'),
	 ('updateProductForSaleStoreOrderEnCamino','/updateProductForSaleStoreOrderEnCamino','update product_for_sale_store_order 
set factory_status_id = 1, store_status_id = 20, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','product_for_sale_store_order','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('getUser','/getUser','select jsonb_build_object(
    ''id'', u.id,
    ''ext_id'', u.external_id,
    ''name'', u.username,
    ''password'', u.password,
    ''email'', u.email,
    ''phone'', u.phone,
    ''creationDate'', u.creation_date,
    ''updatedDate'', coalesce(u.updated_date, u.creation_date),
    ''role'', jsonb_build_object(
        ''id'', r.id,
        ''identifier'', r.name,
        ''status'', r.status,
        ''paths'', paths::jsonb
    ),
    ''status'', jsonb_build_object(
        ''id'', s.id,
        ''identifier'', s.name,
        ''type'', s."type"
    )
) as json_result
from "user" u 
left join "role" r on u.role_id = r.id
left join "status" s on u.status_id = s.id','user','POST'),
	 ('createUser','/createUser','INSERT INTO "user"
(username, status_id, email, phone, role_id, external_id)
VALUES($1, $2, $3, $4, $5, $6)','user','PATCH'),
	 ('Test','/Test','SELECT * FROM sql_queries','sql_queries','GET'),
	 ('getRawMaterialOrder','/getRawMaterialOrder','SELECT json_build_object(
    ''id'', rmo.id,
    ''paidAmount'', rmo.paid_amount,
    ''finalAmount'', rmo.final_amount,
    ''pendingAmount'', rmo.pending_amount,
    ''name'', rmo."name",
    ''description'', rmo.description,
    ''comment'', rmo.description,
    ''creationDate'', rmo.creation_date,
    ''updatedDate'', coalesce(rmo.updated_date, rmo.creation_date),
    ''status'', json_build_object(
        ''identifier'', s.name,
        ''id'', s.id
    ),
    ''paymentStatus'', json_build_object(
        ''identifier'', s2.name,
        ''id'', s2.id
    ),
    ''paymentType'', json_build_object(
        ''identifier'', pt.name,
        ''id'', pt.id
    ),
    ''creatorUser'', json_build_object(
        ''name'', u.username,
        ''email'', u.email,
        ''id'', u.id
    ),
    ''provider'', json_build_object(
        ''name'', p.name,
        ''email'', p.email,
        ''id'', p.id
    ),
    ''rawMaterialOrderElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', rmoe.id,
                ''price'', rmoe.price,
                ''discount'', rmoe.discount,
                ''quantity'', rmoe.quantity,
                ''subtotalPrice'', rmoe.subtotal_price,
                ''totalDiscount'', rmoe.total_discount,
                ''totalPrice'', rmoe.total_price,
                ''rawMaterialByProvider'', json_build_object(
                	''id'', rmbp.id,
                    ''rawMaterialBase'', json_build_object(
                        ''name'', rm.name,
                        ''id'', rm.id
                    ),
                    ''provider'', json_build_object(
                        ''name'', p.name,
                        ''id'', p.id,
                        ''email'', p.email
                    )
                ),
                ''measure'', json_build_object(
                    ''identifier'', m.name,
                    ''id'', m.id,
                    ''unitBase'', json_build_object(
                        ''quantity'', m.unit_base_quantity,
                        ''id'', m.unit_base_id
                    )
                )
            )
        )
        FROM raw_material_order_element rmoe
        LEFT JOIN measure m ON m.id = rmoe.measure_id
        LEFT JOIN raw_material_by_provider rmbp ON rmbp.id = rmoe.raw_material_by_provider_id
        LEFT JOIN raw_material rm ON rm.id = rmbp.raw_material_base_id
        LEFT JOIN provider p ON rmbp.provider_id = p.id
        WHERE rmoe.raw_material_order_id = rmo.id
    ),
    ''rawMaterialOrderPayments'', (
        SELECT json_agg(
            json_build_object(
                ''date'', rmop.date,
                ''amount'', rmop.amount,
                ''paymentType'', pt2.name
            )
        )
        FROM raw_material_order_payment rmop
        LEFT JOIN payment_type pt2 ON rmop.payment_type_id = pt2.id
        WHERE rmop.raw_material_order_id = rmo.id
    )
) AS json_result
FROM raw_material_order rmo
LEFT JOIN status s ON s.id = rmo.status_id
LEFT JOIN status s2 ON s2.id = rmo.payment_status_id
LEFT JOIN payment_type pt ON pt.id = rmo.payment_type_id
LEFT JOIN "user" u ON u.id = rmo.creator_user_id
LEFT JOIN provider p ON p.id = rmo.provider_id','raw_material_order','POST'),
	 ('TestInsert','/InsertSQL','INSERT INTO sql_queries','sql_queries','PUT'),
	 ('addEstablishment','/addEstablishment','insert into establishment','establishment','PUT'),
	 ('addProvider','/addProvider','insert into provider','provider','PUT'),
	 ('addRawMaterial','/addRawMaterial','insert into raw_material','raw_material','PUT'),
	 ('addRawMaterialByProvider','/addRawMaterialByProvider','insert into raw_material_by_provider','raw_material_by_provider','PUT'),
	 ('addFinishedProduct','/addFinishedProduct','insert into finished_product','finished_product','PUT');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('addProductForSale','/addProductForSale','insert into product_for_sale','product_for_sale','PUT'),
	 ('listProductForSaleStoreOrder','/listProductForSaleStoreOrder','SELECT json_agg(
    json_build_object(
        ''id'', pfsso.id,
        ''name'', pfsso.name,
        ''comment'', pfsso.comment,
        ''finalAmount'', pfsso.final_amount,
        ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
        ''creationDate'', pfsso.creation_date,
        ''establishment'', json_build_object(
        	''name'', e."name",
            ''identifier'', e."name",
            ''id'', e.id,
            ''address'', e.address
        ),
        ''storeStatus'', json_build_object(
            ''identifier'', s.name,
            ''id'', s.id,
            ''bg_color'', s.bg_color,
            ''color'', s.color
        ),
        ''factoryStatus'', json_build_object(
            ''identifier'', s2.name,
            ''id'', s2.id
        ),
        ''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email,
            ''id'', u.id
        )
    )
) AS json_result
from product_for_sale_store_order pfsso 
left join establishment e on e.id = pfsso.establishment_id
left join status s on s.id = pfsso.store_status_id
left join status s2 on s2.id = pfsso.factory_status_id
left join "user" u on u.id = pfsso.creator_user_id','product_for_sale_store_order','POST'),
	 ('manageProductForSaleStoreOrder','/manageProductForSaleStoreOrder','call manage_product_for_sale_order_state($1::uuid, $2, $3::uuid)','product_for_sale_store_order','PATCH'),
	 ('confirmAndReceivePFSOrder','/confirmAndReceivePFSOrder','call confirm_and_receive_pfs_order($1::uuid, $2::uuid)','product_for_sale_store_order','PATCH'),
	 ('addManyProductForSale','/addManyProductForSale','call insert_multi_product_for_sale($1,$2::uuid)','product_for_sale','PATCH'),
	 ('updateProductForSale','/updateProductForSale','update product_for_sale 
set price = $1, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $2','product_for_sale','PATCH'),
	 ('deleteProductForSale','/deleteProductForSale','update product_for_sale 
set status_id = 51, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','product_for_sale','PATCH'),
	 ('updateEstablishment','/updateEstablishment','update establishment
set name = $1,
address = $2,
description = $3,
receive_pending_orders_enabled = $4,
establishment_type_id = $5,
updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $6','establishment','PATCH'),
	 ('retriveProductForSaleInventoryActions','/retriveProductForSaleInventoryActions','SELECT json_agg(
    json_build_object(
    	''id'', iea.id,
    	''creationDate'', iea.creation_date,
    	''reason'', iea."comment",
    	''element'', json_build_object(
    		''name'', fp."name"
    	),
    	''measure'', json_build_object(
            ''identifier'', m.name,
            ''unitBase'', json_build_object(
                ''quantity'', m.unit_base_quantity
            )
        ),
    	''quantity'', iea.quantity,
    	''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email
        ),
        ''actionType'', json_build_object(
        	''color'', at.color,
        	''action'', at.action,
            ''name'', at."name"
        )
    )
) as json_result
from inventory_element_action iea
left join inventory_element ie on ie.id = iea.source_inventory_element_id
left join inventory i on i.id = ie.inventory_id
left join measure m on m.id = iea.measure_id 
left join "user" u on u.id = iea.creator_user_id
left join action_type at on at.id = iea.action_type_id 
join product_for_sale pfs on ie.element_fk = pfs.id
left JOIN finished_product fp ON fp.id = pfs.finished_product_id','inventory_element_action','POST'),
	 ('retriveFinishedProductInventoryActions','/retriveFinishedProductInventoryActions','SELECT json_agg(
    json_build_object(
    	''id'', iea.id,
    	''creationDate'', iea.creation_date,
    	''reason'', iea."comment",
    	''element'', json_build_object(
    		''name'', fp."name",
    		''finishedProductTypeId'', fp.finished_product_type_id
    	),
    	''measure'', json_build_object(
            ''identifier'', m.name,
            ''unitBase'', json_build_object(
                ''quantity'', m.unit_base_quantity
            )
        ),
    	''quantity'', iea.quantity,
    	''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email
        ),
        ''actionType'', json_build_object(
        	''color'', at.color,
        	''action'', at.action,
            ''name'', at."name"
        )
    )
) as json_result
from inventory_element_action iea
left join inventory_element ie on ie.id = iea.source_inventory_element_id
left join inventory i on i.id = ie.inventory_id
left join measure m on m.id = iea.measure_id
left join "user" u on u.id = iea.creator_user_id
left join action_type at on at.id = iea.action_type_id
join finished_product fp on ie.element_fk = fp.id','inventory_element_action','POST'),
	 ('retriveRawMaterialInventoryActions','/retriveRawMaterialInventoryActions','SELECT json_agg(
    json_build_object(
    	''id'', iea.id,
    	''creationDate'', iea.creation_date,
    	''reason'', iea."comment",
    	''element'', json_build_object(
    		''name'', rm."name"
    	),
    	''measure'', json_build_object(
            ''identifier'', m.name,
            ''unitBase'', json_build_object(
                ''quantity'', m.unit_base_quantity
            )
        ),
    	''quantity'', iea.quantity,
    	''creatorUser'', json_build_object(
            ''name'', u.username,
            ''email'', u.email
        ),
        ''actionType'', json_build_object(
        	''color'', at.color,
        	''action'', at.action,
            ''name'', at."name"
        )
    )
) as json_result
from inventory_element_action iea
left join inventory_element ie on ie.id = iea.source_inventory_element_id
left join inventory i on i.id = ie.inventory_id
left join measure m on m.id = iea.measure_id 
left join "user" u on u.id = iea.creator_user_id
left join action_type at on at.id = iea.action_type_id 
join raw_material rm on ie.element_fk = rm.id','inventory_element_action','POST');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('deleteEstablishment','/deleteEstablishment','update establishment
set status_id = 29, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','establishment','PATCH'),
	 ('updateProvider','/updateProvider','update provider
set name = $1, phone = $2, description = $3, company = $4, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $5','provider','PATCH'),
	 ('deleteProvider','/deleteProvider','update provider
set status_id = 31, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','provider','PATCH'),
	 ('deleteRawMaterial','/deleteRawMaterial','update raw_material
set status_id = 33, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','raw_material','PATCH'),
	 ('UpdateRawMaterial','/UpdateRawMaterial','update raw_material
set name = $1, description = $2, photo = $3, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $4','raw_material','PATCH'),
	 ('deleteRawMaterialByProvider','/deleteRawMaterialByProvider','UPDATE raw_material_by_provider
SET status_id = 35, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $1','raw_material_by_provider','PATCH'),
	 ('updateRawMaterialByProvider','/updateRawMaterialByProvider','UPDATE raw_material_by_provider
SET price= $1::numeric, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $2','raw_material_by_provider','PATCH'),
	 ('updateFinishedProduct','/updateFinishedProduct','UPDATE finished_product
SET name=$1, description=$2, photo=$3, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $4','finished_product','PATCH'),
	 ('deleteFinishedProduct','/deleteFinishedProduct','UPDATE finished_product
SET status_id=37, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
WHERE id = $1','finished_product','PATCH'),
	 ('addRawMaterialOrder','/addRawMaterialOrder','call public.create_raw_material_order_with_elements($1,$2)','raw_material_order','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('updateRawMaterialOrderElements','/updateRawMaterialOrderElements','call update_raw_material_order_elements($1::uuid,$2,$3)','raw_material_order','PATCH'),
	 ('updateRawMaterialOrder','/updateRawMaterialOrder','update raw_material_order 
set name = $1, payment_type_id = $2, description = $3, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $4','raw_material_order','PATCH'),
	 ('deleteRawMaterialOrder','/deleteRawMaterialOrder','update raw_material_order 
set status_id = 43, updated_date = timezone(''UTC''::text, CURRENT_TIMESTAMP)
where id = $1','raw_material_order','PATCH'),
	 ('addRawMaterialOrderPaymentHistory','/addRawMaterialOrderPaymentHistory','call add_raw_material_order_payment($1::uuid, $2::numeric, $3)','raw_material_order','PATCH'),
	 ('verifyRawMaterialOrder','/verifyRawMaterialOrder','call verify_raw_material_order($1::uuid,$2,$3,$4::uuid)','raw_material_order','PATCH'),
	 ('addRemoveInventoryElement','/addRemoveInventoryElement','call add_remove_inventory_element($1, $2, $3::uuid, $4, $5, $6::uuid, $7, $8)','inventory_element','PATCH'),
	 ('multiAddRemoveInventoryElement','/multiAddRemoveInventoryElement','call multi_add_remove_inventory_elements($1)','inventory_element','PATCH'),
	 ('addProductForSaleStoreOrder','/addProductForSaleStoreOrder','call create_product_for_sale_order_with_elements($1,$2)','product_for_sale_store_order','PATCH'),
	 ('getProductForSaleStoreOrder','/getProductForSaleStoreOrder','SELECT json_build_object(
    ''id'', pfsso.id,
    ''name'', pfsso.name,
    ''comment'', pfsso.comment,
    ''finalAmount'', pfsso.final_amount,
    ''updatedDate'', coalesce(pfsso.updated_date, pfsso.creation_date),
    ''creationDate'', pfsso.creation_date,
    ''establishment'', json_build_object(
        ''identifier'', e."name",
        ''id'', e.id,
        ''address'', e.address
    ),
    ''storeStatus'', json_build_object(
        ''identifier'', s.name,
        ''id'', s.id
    ),
    ''factoryStatus'', json_build_object(
        ''identifier'', s2.name,
        ''id'', s2.id
    ),
    ''creatorUser'', json_build_object(
        ''name'', u.username,
        ''email'', u.email,
        ''id'', u.id
    ),
    ''productForSaleStoreOrderElements'', (
	    SELECT json_agg(
		    json_build_object(
		    	''id'', pfssoe.id,
		    	''price'', pfssoe.price,
		    	''quantity'', pfssoe.quantity,
		    	''totalPrice'', pfssoe.total_price,
		    	''date'', pfssoe."date",
		    	''measure'', json_build_object(
		    		''id'', m5.id,
	                ''identifier'', m5.name
	            ),
		        ''productForSale'', json_build_object(
		        	''id'', pfs.id,
			        ''creationDate'', pfs.creation_date,
				    ''updatedDate'', pfs.updated_date,
			        ''price'', pfs.price,
			        ''finishedProduct'', json_build_object(
			            ''id'', fp.id,
			            ''name'', fp.name,
			            ''photo'', fp.photo,
			            ''description'', fp.description,
			            ''measure'', json_build_object(
			                ''identifier'', ub.name,
			                ''type'', ub."type"
			            )
			        ),
			        ''status'', json_build_object(
			            ''name'', s3.name,
			            ''type'', s3."type"
			        ),
			        ''establishment'', json_build_object(
			            ''id'', e3.id,
			            ''name'', e3.name
			        )
		        )
		    )
		)
		from product_for_sale_store_order_element pfssoe
		left join product_for_sale pfs on pfs.id = pfssoe.product_for_sale_id
		LEFT JOIN finished_product fp ON pfs.finished_product_id = fp.id
		LEFT JOIN unit_base ub ON fp.unit_base_id = ub.id
		LEFT JOIN establishment e3 ON e3.id = pfs.establishment_id
		LEFT JOIN status s3 ON s3.id = pfs.status_id
		left join measure m5 on m5.id = pfssoe.measure_id
		WHERE pfssoe.pfsso_id = pfsso.id
	)
) as json_result
from product_for_sale_store_order pfsso 
left join establishment e on e.id = pfsso.establishment_id
left join status s on s.id = pfsso.store_status_id
left join status s2 on s2.id = pfsso.factory_status_id
left join "user" u on u.id = pfsso.creator_user_id','product_for_sale_store_order','POST'),
	 ('deleteUser','/deleteUser','update "user"
set status_id = 8
where id = $1::uuid','user','PATCH');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
	 ('retrieveProductForSaleInventory','/retrieveProductForSaleInventory','WITH inventory_elements_ordered AS (
    SELECT
        ie.inventory_id,
        ie.id AS ie_id,
        ie.element_type,
        ie.quantity,
        pfs.id AS pfs_id,
        pfs.price AS pfs_price,
        pfs.creation_date AS pfs_creation_date,
        fp.id AS fp_id,
        fp.name AS fp_name,
        fp.photo AS fp_photo,
        m.id AS m_id,
        m.name AS m_name,
        m.unit_base_quantity,
        ub.id AS ub_id,
        ub.name AS ub_name,
        sie.id AS sie_id,
        sie.name AS sie_name,
        srm.id AS srm_id,
        srm.name AS srm_name
    FROM inventory_element ie
    JOIN product_for_sale pfs ON ie.element_fk = pfs.id
    LEFT JOIN finished_product fp ON fp.id = pfs.finished_product_id
    LEFT JOIN status sie ON sie.id = pfs.status_id
    LEFT JOIN measure m ON m.id = ie.measure_id
    LEFT JOIN unit_base ub ON ub.id = m.unit_base_id
    LEFT JOIN status srm ON srm.id = fp.status_id
    WHERE ie.element_type = ''product_for_sale''
      AND sie."name" = ''Activo''
)
SELECT json_build_object(
    ''id'', i.id,
    ''inventoryType'', i.inventory_type,
    ''unitName'', i.unit_name,
    ''creationDate'', i.creation_date,
    ''establishment'', json_build_object(
        ''id'', e.id,
        ''name'', e."name"
    ),
    ''inventoryElements'', (
        SELECT json_agg(
            json_build_object(
                ''id'', oe.ie_id,
                ''element_type'', oe.element_type,
                ''quantity'', oe.quantity,
                ''status'', json_build_object(
                    ''identifier'', oe.sie_name,
                    ''id'', oe.sie_id
                ),
                ''measure'', json_build_object(
                    ''id'', oe.m_id,
                    ''identifier'', oe.m_name,
                    ''unitBase'', json_build_object(
                        ''quantity'', oe.unit_base_quantity,
                        ''name'', oe.ub_name,
                        ''id'', oe.ub_id
                    )
                ),
                ''productForSale'', json_build_object(
                    ''id'', oe.pfs_id,
                    ''price'', oe.pfs_price,
                    ''finishedProduct'', json_build_object(
                        ''id'', oe.fp_id,
                        ''name'', oe.fp_name,
                        ''photo'', oe.fp_photo,
                        ''status'', json_build_object(
                            ''id'', oe.srm_id,
                            ''identifier'', oe.srm_name
                        ),
                        ''measure'', json_build_object(
                            ''identifier'', oe.ub_name
                        )
                    )
                )
            ) ORDER BY oe.pfs_creation_date
        )
        FROM inventory_elements_ordered oe
        WHERE oe.inventory_id = i.id
    )
) AS json_result
FROM inventory i
LEFT JOIN establishment e ON e.id::text = i.unit_name','inventory','POST');
INSERT INTO public.finished_product_type (id, "name") VALUES
    (1, 'embutido'),
    (2, 'abarrote');

INSERT INTO public.establishment_type (id, "name") VALUES
    (1, 'producto'),
    (2, 'abarrote');

INSERT INTO public.raw_material_by_provider_type (id, "name") VALUES
    (1, 'alimento'),
    (2, 'empaque');
INSERT INTO public.action_type (id, status, "name", "type", action) VALUES
    (17, 1, 'Retiro de PFS por devolucion', 'product_for_sale', 'remove'),
    (18, 1, 'Ingreso de FP por devolucion de tienda', 'finished_product', 'add');
INSERT INTO public.sql_queries (descripcion,"path",consulta_sql,principal_table,"type") VALUES
    ('returnPFSToWarehouse','/returnPFSToWarehouse','call return_pfs_to_warehouse($1, $2, $3::uuid, $4, $5, $6::uuid, $7)','inventory_element','PATCH');


INSERT INTO public."role" (status,name,paths) VALUES
	 (1,'Indefinido','[
        {
          "name": "/home",
          "route": "/home",
          "matchPattern": "^/home$"
        },
        {
          "name": "/activityLog",
          "route": "/activityLog",
          "matchPattern": "^/activityLog/[^/]*$"
        },
        {
          "name": "/users/view",
          "route": "/users/view",
          "matchPattern": "^/users/view/[^/]*$"
        }
      ]'),
	 (1,'Proveedores','[
        {
          "name": "/providers/edit",
          "route": "/providers/edit",
          "matchPattern": "^/providers/edit/[^/]*$"
        },
        {
          "name": "/providers/create",
          "route": "/providers/create",
          "matchPattern": "^/providers/create$"
        },
        {
          "name": "/providers/view",
          "route": "/providers/view",
          "matchPattern": "^/providers/view/[^/]*$"
        },
        {
          "name": "/providers",
          "route": "/providers",
          "matchPattern": "^/providers$"
        },
        {
          "name": "/home",
          "route": "/home",
          "matchPattern": "^/home$"
        },
        {
          "name": "/activityLog",
          "route": "/activityLog",
          "matchPattern": "^/activityLog/[^/]*$"
        },
        {
          "name": "/users/view",
          "route": "/users/view",
          "matchPattern": "^/users/view/[^/]*$"
        },
        {
          "name": "/rawMaterials",
          "route": "/rawMaterials",
          "matchPattern": "^/rawMaterials$"
        },
        {
          "name": "/rawMaterials/create",
          "route": "/rawMaterials/create",
          "matchPattern": "^/rawMaterials/create$"
        },
        {
          "name": "/rawMaterials/edit",
          "route": "/rawMaterials/edit",
          "matchPattern": "^/rawMaterials/edit/[^/]*$"
        },
        {
          "name": "/rawMaterials/view",
          "route": "/rawMaterials/view",
          "matchPattern": "^/rawMaterials/view/[^/]*$"
        },
        {
          "name": "/rawMaterialByProvider/order",
          "route": "/rawMaterialByProvider/order",
          "matchPattern": "^/rawMaterialByProvider/order$"
        },
        {
          "name": "/rawMaterialByProvider/order/create",
          "route": "/rawMaterialByProvider/order/create",
          "matchPattern": "^/rawMaterialByProvider/order/create$"
        },
        {
          "name": "/rawMaterialByProvider/order/view",
          "route": "/rawMaterialByProvider/order/view",
          "matchPattern": "^/rawMaterialByProvider/order/view/[^/]*$"
        },
        {
          "name": "/rawMaterialByProvider/order/edit",
          "route": "/rawMaterialByProvider/order/edit",
          "matchPattern": "^/rawMaterialByProvider/order/edit/[^/]*$"
        },
        {
          "name": "/rawMaterialsByProvider",
          "route": "/rawMaterialsByProvider",
          "matchPattern": "^/rawMaterialsByProvider$"
        },
        {
          "name": "/rawMaterialsByProvider/create",
          "route": "/rawMaterialsByProvider/create",
          "matchPattern": "^/rawMaterialsByProvider/create$"
        },
        {
          "name": "/rawMaterialsByProvider/view",
          "route": "/rawMaterialsByProvider/view",
          "matchPattern": "^/rawMaterialsByProvider/view/[^/]*$"
        },
        {
          "name": "/rawMaterialsByProvider/edit",
          "route": "/rawMaterialsByProvider/edit",
          "matchPattern": "^/rawMaterialsByProvider/edit/[^/]*$"
        },
        {
          "name": "/empaques",
          "route": "/empaques",
          "matchPattern": "^/empaques$"
        },
        {
          "name": "/empaques/create",
          "route": "/empaques/create",
          "matchPattern": "^/empaques/create$"
        },
        {
          "name": "/empaques/view",
          "route": "/empaques/view",
          "matchPattern": "^/empaques/view/[^/]*$"
        },
        {
          "name": "/empaques/edit",
          "route": "/empaques/edit",
          "matchPattern": "^/empaques/edit/[^/]*$"
        }
      ]'),
	 (1,'Ventas','[
        {
          "name": "/home",
          "route": "/home",
          "matchPattern": "^/home$"
        },
        {
          "name": "/activityLog",
          "route": "/activityLog",
          "matchPattern": "^/activityLog/[^/]*$"
        },
        {
          "name": "/users/view",
          "route": "/users/view",
          "matchPattern": "^/users/view/[^/]*$"
        },
        {
          "name": "/store",
          "route": "/store",
          "matchPattern": "^/store[^/]*$"
        },
        {
          "name": "/store/inventory",
          "route": "/store/inventory",
          "matchPattern": "^/store/inventory/[^/]*$"
        },
        {
          "name": "/store/sales/history",
          "route": "/store/sales/history",
          "matchPattern": "^/store/sales/history/[^/]*$"
        },
        {
          "name": "/store/sales/history/view",
          "route": "/store/sales/history/view",
          "matchPattern": "^/store/sales/history/view/[^/]*$"
        },
        {
          "name": "/store/sales/create",
          "route": "/store/sales/create",
          "matchPattern": "^/store/sales/create[^/]*$"
        },
        {
          "name": "/store/sales/history/edit",
          "route": "/store/sales/history/edit",
          "matchPattern": "^/store/sales/history/edit/[^/]*$"
        },
        {
          "name": "/productsForSale/order",
          "route": "/productsForSale/order",
          "matchPattern": "^/productsForSale/order[^/]*opt=store[^/]*"
        },
        {
          "name": "/productsForSale/order/create",
          "route": "/productsForSale/order/create",
          "matchPattern": "^/productsForSale/order/create.*opt=store.*"
        },
        {
          "name": "/productsForSale/order/edit",
          "route": "/productsForSale/order/edit",
          "matchPattern": "^/productsForSale/order/edit/[^/]*$"
        },
        {
          "name": "/productsForSale/order/view",
          "route": "/productsForSale/order/view",
          "matchPattern": "^/productsForSale/order/view/[^/]*$"
        },
        {
          "name": "/cashClosing",
          "route": "/cashClosing",
          "matchPattern": "^/cashClosing/[^/]*$"
        },
        {
          "name": "/cashClosing/view",
          "route": "/cashClosing/view",
          "matchPattern": "^/cashClosing/view/[^/]*$"
        },
        {
          "name": "/cashClosing/create",
          "route": "/cashClosing/create",
          "matchPattern": "^/cashClosing/create/[^/]*$"
        },
        {
          "name": "/cashClosing/edit",
          "route": "/cashClosing/edit",
          "matchPattern": "^/cashClosing/edit/[^/]*$"
        }
      ]'),
	 (1,'Bodega','[
        {
          "name": "/home",
          "route": "/home",
          "matchPattern": "^/home$"
        },
        {
          "name": "/activityLog",
          "route": "/activityLog",
          "matchPattern": "^/activityLog/[^/]*$"
        },
        {
          "name": "/users/view",
          "route": "/users/view",
          "matchPattern": "^/users/view/[^/]*$"
        },
        {
          "name": "/inventory/factory/rawMaterial",
          "route": "/inventory/factory/rawMaterial",
          "matchPattern": "^/inventory/factory/rawMaterial$"
        },
        {
          "name": "/consumeRawMaterial",
          "route": "/consumeRawMaterial",
          "matchPattern": "^/consumeRawMaterial$"
        },
        {
          "name": "/productCreation",
          "route": "/productCreation",
          "matchPattern": "^/productCreation$"
        },
        {
          "name": "/inventory/factory/finishedProduct",
          "route": "/inventory/factory/finishedProduct",
          "matchPattern": "^/inventory/factory/finishedProduct$"
        },
        {
          "name": "/finishedProduct/order",
          "route": "/finishedProduct/order",
          "matchPattern": "^/finishedProduct/order[^/]+$"
        },
        {
          "name": "/productsForSale/order",
          "route": "/productsForSale/order",
          "matchPattern": "^/productsForSale/order[^/]+$"
        },
        {
          "name": "/productsForSale/order/view",
          "route": "/productsForSale/order/view",
          "matchPattern": "^/productsForSale/order/view/[^/]*$"
        },
        {
          "name": "/productsForSale/order/edit",
          "route": "/productsForSale/order/edit",
          "matchPattern": "^/productsForSale/order/edit/[^/]*$"
        },
        {
          "name": "/store",
          "route": "/store",
          "matchPattern": "^/store[^/]*$"
        },
        {
          "name": "/store/inventory",
          "route": "/store/inventory",
          "matchPattern": "^/store/inventory/[^/]*$"
        },
        {
          "name": "/store/sales/history",
          "route": "/store/sales/history",
          "matchPattern": "^/store/sales/history/[^/]*$"
        },
        {
          "name": "/store/sales/history/view",
          "route": "/store/sales/history/view",
          "matchPattern": "^/store/sales/history/view/[^/]*$"
        },
        {
          "name": "/store/sales/create",
          "route": "/store/sales/create",
          "matchPattern": "^/store/sales/create[^/]*$"
        },
        {
          "name": "/store/sales/history/edit",
          "route": "/store/sales/history/edit",
          "matchPattern": "^/store/sales/history/edit/[^/]*$"
        },
        {
          "name": "/productsForSale/order",
          "route": "/productsForSale/order",
          "matchPattern": "^/productsForSale/order[^/]*opt=store[^/]*"
        },
        {
          "name": "/productsForSale/order/create",
          "route": "/productsForSale/order/create",
          "matchPattern": "^/productsForSale/order/create.*opt=store.*"
        },
        {
          "name": "/productsForSale/order/edit",
          "route": "/productsForSale/order/edit",
          "matchPattern": "^/productsForSale/order/edit/[^/]*$"
        },
        {
          "name": "/productsForSale/order/view",
          "route": "/productsForSale/order/view",
          "matchPattern": "^/productsForSale/order/view/[^/]*$"
        },
        {
          "name": "/cashClosing",
          "route": "/cashClosing",
          "matchPattern": "^/cashClosing/[^/]*$"
        },
        {
          "name": "/cashClosing/view",
          "route": "/cashClosing/view",
          "matchPattern": "^/cashClosing/view/[^/]*$"
        },
        {
          "name": "/cashClosing/create",
          "route": "/cashClosing/create",
          "matchPattern": "^/cashClosing/create/[^/]*$"
        },
        {
          "name": "/cashClosing/edit",
          "route": "/cashClosing/edit",
          "matchPattern": "^/cashClosing/edit/[^/]*$"
        },
        {
          "name": "/inventory/warehouse/packagingMaterial",
          "route": "/inventory/warehouse/packagingMaterial",
          "matchPattern": "^/inventory/warehouse/packagingMaterial$"
        }
      ]'),
	 (1,'Fabrica','[
        {
          "name": "/home",
          "route": "/home",
          "matchPattern": "^/home$"
        },
        {
          "name": "/activityLog",
          "route": "/activityLog",
          "matchPattern": "^/activityLog/[^/]*$"
        },
        {
          "name": "/users/view",
          "route": "/users/view",
          "matchPattern": "^/users/view/[^/]*$"
        },
        {
          "name": "/inventory/factory/rawMaterial",
          "route": "/inventory/factory/rawMaterial",
          "matchPattern": "^/inventory/factory/rawMaterial$"
        },
        {
          "name": "/productCreation",
          "route": "/productCreation",
          "matchPattern": "^/productCreation$"
        },
        {
          "name": "/inventory/factory/finishedProduct",
          "route": "/inventory/factory/finishedProduct",
          "matchPattern": "^/inventory/factory/finishedProduct$"
        },
        {
          "name": "/finishedProduct/order",
          "route": "/finishedProduct/order",
          "matchPattern": "^/finishedProduct/order[^/]+$"
        },
        {
          "name": "/productsForSale/order",
          "route": "/productsForSale/order",
          "matchPattern": "^/productsForSale/order[^/]+$"
        },
        {
          "name": "/productsForSale/order/view",
          "route": "/productsForSale/order/view",
          "matchPattern": "^/productsForSale/order/view/[^/]*$"
        },
        {
          "name": "/productsForSale/order/edit",
          "route": "/productsForSale/order/edit",
          "matchPattern": "^/productsForSale/order/edit/[^/]*$"
        }
      ]'),
	 (1,'Auxiliar Administrativo','[
        {
          "name": "/home",
          "route": "/home",
          "matchPattern": "^/home$"
        },
        {
          "name": "/activityLog",
          "route": "/activityLog",
          "matchPattern": "^/activityLog/[^/]*$"
        },
        {
          "name": "/users/view",
          "route": "/users/view",
          "matchPattern": "^/users/view/[^/]*$"
        },
        {
          "name": "/providers/edit",
          "route": "/providers/edit",
          "matchPattern": "^/providers/edit/[^/]*$"
        },
        {
          "name": "/providers/create",
          "route": "/providers/create",
          "matchPattern": "^/providers/create$"
        },
        {
          "name": "/providers/view",
          "route": "/providers/view",
          "matchPattern": "^/providers/view/[^/]*$"
        },
        {
          "name": "/providers",
          "route": "/providers",
          "matchPattern": "^/providers$"
        },
        {
          "name": "/rawMaterials",
          "route": "/rawMaterials",
          "matchPattern": "^/rawMaterials$"
        },
        {
          "name": "/rawMaterials/create",
          "route": "/rawMaterials/create",
          "matchPattern": "^/rawMaterials/create$"
        },
        {
          "name": "/rawMaterials/edit",
          "route": "/rawMaterials/edit",
          "matchPattern": "^/rawMaterials/edit/[^/]*$"
        },
        {
          "name": "/rawMaterials/view",
          "route": "/rawMaterials/view",
          "matchPattern": "^/rawMaterials/view/[^/]*$"
        },
        {
          "name": "/rawMaterialByProvider/order",
          "route": "/rawMaterialByProvider/order",
          "matchPattern": "^/rawMaterialByProvider/order$"
        },
        {
          "name": "/rawMaterialByProvider/order/create",
          "route": "/rawMaterialByProvider/order/create",
          "matchPattern": "^/rawMaterialByProvider/order/create$"
        },
        {
          "name": "/rawMaterialByProvider/order/view",
          "route": "/rawMaterialByProvider/order/view",
          "matchPattern": "^/rawMaterialByProvider/order/view/[^/]*$"
        },
        {
          "name": "/rawMaterialByProvider/order/edit",
          "route": "/rawMaterialByProvider/order/edit",
          "matchPattern": "^/rawMaterialByProvider/order/edit/[^/]*$"
        },
        {
          "name": "/rawMaterialsByProvider",
          "route": "/rawMaterialsByProvider",
          "matchPattern": "^/rawMaterialsByProvider$"
        },
        {
          "name": "/rawMaterialsByProvider/create",
          "route": "/rawMaterialsByProvider/create",
          "matchPattern": "^/rawMaterialsByProvider/create$"
        },
        {
          "name": "/rawMaterialsByProvider/view",
          "route": "/rawMaterialsByProvider/view",
          "matchPattern": "^/rawMaterialsByProvider/view/[^/]*$"
        },
        {
          "name": "/rawMaterialsByProvider/edit",
          "route": "/rawMaterialsByProvider/edit",
          "matchPattern": "^/rawMaterialsByProvider/edit/[^/]*$"
        },
        {
          "name": "/store",
          "route": "/store",
          "matchPattern": "^/store[^/]*$"
        },
        {
          "name": "/store/inventory",
          "route": "/store/inventory",
          "matchPattern": "^/store/inventory/[^/]*$"
        },
        {
          "name": "/store/sales/history",
          "route": "/store/sales/history",
          "matchPattern": "^/store/sales/history/[^/]*$"
        },
        {
          "name": "/store/sales/history/view",
          "route": "/store/sales/history/view",
          "matchPattern": "^/store/sales/history/view/[^/]*$"
        },
        {
          "name": "/store/sales/create",
          "route": "/store/sales/create",
          "matchPattern": "^/store/sales/create[^/]*$"
        },
        {
          "name": "/store/sales/history/edit",
          "route": "/store/sales/history/edit",
          "matchPattern": "^/store/sales/history/edit/[^/]*$"
        },
        {
          "name": "/productsForSale/order",
          "route": "/productsForSale/order",
          "matchPattern": "^/productsForSale/order[^/]*opt=store[^/]*"
        },
        {
          "name": "/productsForSale/order/create",
          "route": "/productsForSale/order/create",
          "matchPattern": "^/productsForSale/order/create.*opt=store.*"
        },
        {
          "name": "/productsForSale/order/edit",
          "route": "/productsForSale/order/edit",
          "matchPattern": "^/productsForSale/order/edit/[^/]*$"
        },
        {
          "name": "/productsForSale/order/view",
          "route": "/productsForSale/order/view",
          "matchPattern": "^/productsForSale/order/view/[^/]*$"
        },
        {
          "name": "/cashClosing",
          "route": "/cashClosing",
          "matchPattern": "^/cashClosing/[^/]*$"
        },
        {
          "name": "/cashClosing/view",
          "route": "/cashClosing/view",
          "matchPattern": "^/cashClosing/view/[^/]*$"
        },
        {
          "name": "/cashClosing/create",
          "route": "/cashClosing/create",
          "matchPattern": "^/cashClosing/create/[^/]*$"
        },
        {
          "name": "/cashClosing/edit",
          "route": "/cashClosing/edit",
          "matchPattern": "^/cashClosing/edit/[^/]*$"
        },
        {
          "name": "/inventory/factory/rawMaterial",
          "route": "/inventory/factory/rawMaterial",
          "matchPattern": "^/inventory/factory/rawMaterial$"
        },
        {
          "name": "/consumeRawMaterial",
          "route": "/consumeRawMaterial",
          "matchPattern": "^/consumeRawMaterial$"
        },
        {
          "name": "/productCreation",
          "route": "/productCreation",
          "matchPattern": "^/productCreation$"
        },
        {
          "name": "/inventory/factory/finishedProduct",
          "route": "/inventory/factory/finishedProduct",
          "matchPattern": "^/inventory/factory/finishedProduct$"
        },
        {
          "name": "/finishedProduct/order",
          "route": "/finishedProduct/order",
          "matchPattern": "^/finishedProduct/order[^/]+$"
        },
        {
          "name": "/productsForSale/order",
          "route": "/productsForSale/order",
          "matchPattern": "^/productsForSale/order[^/]+$"
        },
        {
          "name": "/productsForSale/order/view",
          "route": "/productsForSale/order/view",
          "matchPattern": "^/productsForSale/order/view/[^/]*$"
        },
        {
          "name": "/productsForSale/order/edit",
          "route": "/productsForSale/order/edit",
          "matchPattern": "^/productsForSale/order/edit/[^/]*$"
        }
      ]'),
	 (1,'Sistema','[
        {
          "name": "/home",
          "route": "/home",
          "matchPattern": "^/home$"
        },
        {
          "name": "/activityLog",
          "route": "/activityLog",
          "matchPattern": "^/activityLog/[^/]*$"
        },
        {
          "name": "/finishedProducts",
          "route": "/finishedProducts",
          "matchPattern": "^/finishedProducts$"
        },
        {
          "name": "/finishedProducts/create",
          "route": "/finishedProducts/create",
          "matchPattern": "^/finishedProducts/create$"
        },
        {
          "name": "/finishedProducts/edit",
          "route": "/finishedProducts/edit",
          "matchPattern": "^/finishedProducts/edit/[^/]*$"
        },
        {
          "name": "/finishedProducts/view",
          "route": "/finishedProducts/view",
          "matchPattern": "^/finishedProducts/view/[^/]*$"
        },
                {
          "name": "/abarrotes",
          "route": "/abarrotes",
          "matchPattern": "^/abarrotes$"
        },
        {
          "name": "/abarrotes/create",
          "route": "/abarrotes/create",
          "matchPattern": "^/abarrotes/create$"
        },
        {
          "name": "/abarrotes/edit",
          "route": "/abarrotes/edit",
          "matchPattern": "^/abarrotes/edit/[^/]*$"
        },
        {
          "name": "/abarrotes/view",
          "route": "/abarrotes/view",
          "matchPattern": "^/abarrotes/view/[^/]*$"
        },
        {
          "name": "/productsForSale/order",
          "route": "/productsForSale/order",
          "matchPattern": "^/productsForSale/order[^/]+$"
        },
        {
          "name": "/finishedProduct/order",
          "route": "/finishedProduct/order",
          "matchPattern": "^/finishedProduct/order[^/]+$"
        },
        {
          "name": "/productsForSale/order/create",
          "route": "/productsForSale/order/create",
          "matchPattern": "^/productsForSale/order/create[^/]*$"
        },
        {
          "name": "/productsForSale/order/edit",
          "route": "/productsForSale/order/edit",
          "matchPattern": "^/productsForSale/order/edit/[^/]*$"
        },
        {
          "name": "/productsForSale/order/view",
          "route": "/productsForSale/order/view",
          "matchPattern": "^/productsForSale/order/view/[^/]*$"
        },
        {
          "name": "/productsForSale/create",
          "route": "/productsForSale/create",
          "matchPattern": "^/productsForSale/create$"
        },
        {
          "name": "/productsForSale/edit",
          "route": "/productsForSale/edit",
          "matchPattern": "^/productsForSale/edit/[^/]*$"
        },
        {
          "name": "/productsForSale",
          "route": "/productsForSale",
          "matchPattern": "^/productsForSale[^/]+$"
        },
        {
          "name": "/productsForSale/view",
          "route": "/productsForSale/view",
          "matchPattern": "^/productsForSale/view/[^/]*$"
        },
        {
          "name": "/establishments",
          "route": "/establishments",
          "matchPattern": "^/establishments$"
        },
        {
          "name": "/establishments/create",
          "route": "/establishments/create",
          "matchPattern": "^/establishments/create$"
        },
        {
          "name": "/establishments/edit",
          "route": "/establishments/edit",
          "matchPattern": "^/establishments/edit/[^/]*$"
        },
        {
          "name": "/establishments/view",
          "route": "/establishments/view",
          "matchPattern": "^/establishments/view/[^/]*$"
        },
        {
          "name": "/providers",
          "route": "/providers",
          "matchPattern": "^/providers$"
        },
        {
          "name": "/providers/create",
          "route": "/providers/create",
          "matchPattern": "^/providers/create$"
        },
        {
          "name": "/providers/edit",
          "route": "/providers/edit",
          "matchPattern": "^/providers/edit/[^/]*$"
        },
        {
          "name": "/providers/view",
          "route": "/providers/view",
          "matchPattern": "^/providers/view/[^/]*$"
        },
        {
          "name": "/rawMaterials",
          "route": "/rawMaterials",
          "matchPattern": "^/rawMaterials$"
        },
        {
          "name": "/rawMaterials/create",
          "route": "/rawMaterials/create",
          "matchPattern": "^/rawMaterials/create$"
        },
        {
          "name": "/rawMaterials/edit",
          "route": "/rawMaterials/edit",
          "matchPattern": "^/rawMaterials/edit/[^/]*$"
        },
        {
          "name": "/rawMaterials/view",
          "route": "/rawMaterials/view",
          "matchPattern": "^/rawMaterials/view/[^/]*$"
        },
        {
          "name": "/rawMaterialByProvider/order",
          "route": "/rawMaterialByProvider/order",
          "matchPattern": "^/rawMaterialByProvider/order$"
        },
        {
          "name": "/rawMaterialByProvider/order/create",
          "route": "/rawMaterialByProvider/order/create",
          "matchPattern": "^/rawMaterialByProvider/order/create$"
        },
        {
          "name": "/rawMaterialByProvider/order/view",
          "route": "/rawMaterialByProvider/order/view",
          "matchPattern": "^/rawMaterialByProvider/order/view/[^/]*$"
        },
        {
          "name": "/rawMaterialByProvider/order/edit",
          "route": "/rawMaterialByProvider/order/edit",
          "matchPattern": "^/rawMaterialByProvider/order/edit/[^/]*$"
        },
        {
          "name": "/rawMaterialsByProvider",
          "route": "/rawMaterialsByProvider",
          "matchPattern": "^/rawMaterialsByProvider$"
        },
        {
          "name": "/rawMaterialsByProvider/create",
          "route": "/rawMaterialsByProvider/create",
          "matchPattern": "^/rawMaterialsByProvider/create$"
        },
        {
          "name": "/rawMaterialsByProvider/view",
          "route": "/rawMaterialsByProvider/view",
          "matchPattern": "^/rawMaterialsByProvider/view/[^/]*$"
        },
        {
          "name": "/rawMaterialsByProvider/edit",
          "route": "/rawMaterialsByProvider/edit",
          "matchPattern": "^/rawMaterialsByProvider/edit/[^/]*$"
        },
        {
          "name": "/empaques",
          "route": "/empaques",
          "matchPattern": "^/empaques$"
        },
        {
          "name": "/empaques/create",
          "route": "/empaques/create",
          "matchPattern": "^/empaques/create$"
        },
        {
          "name": "/empaques/view",
          "route": "/empaques/view",
          "matchPattern": "^/empaques/view/[^/]*$"
        },
        {
          "name": "/empaques/edit",
          "route": "/empaques/edit",
          "matchPattern": "^/empaques/edit/[^/]*$"
        },
        {
          "name": "/inventory/warehouse/packagingMaterial",
          "route": "/inventory/warehouse/packagingMaterial",
          "matchPattern": "^/inventory/warehouse/packagingMaterial$"
        },
        {
          "name": "/inventory/factory/rawMaterial",
          "route": "/inventory/factory/rawMaterial",
          "matchPattern": "^/inventory/factory/rawMaterial$"
        },
        {
          "name": "/inventory/factory/finishedProduct",
          "route": "/inventory/factory/finishedProduct",
          "matchPattern": "^/inventory/factory/finishedProduct$"
        },
        {
          "name": "/inventory/factory/abarrote",
          "route": "/inventory/factory/abarrote",
          "matchPattern": "^/inventory/factory/abarrote$"
        },
        {
          "name": "/store",
          "route": "/store",
          "matchPattern": "^/store[^/]*$"
        },
        {
          "name": "/store/inventory",
          "route": "/store/inventory",
          "matchPattern": "^/store/inventory/[^/]*$"
        },
        {
          "name": "/consumeRawMaterial",
          "route": "/consumeRawMaterial",
          "matchPattern": "^/consumeRawMaterial$"
        },
        {
          "name": "/productCreation",
          "route": "/productCreation",
          "matchPattern": "^/productCreation$"
        },
        {
          "name": "/abarroteCreation",
          "route": "/abarroteCreation",
          "matchPattern": "^/abarroteCreation$"
        },
        {
          "name": "/users",
          "route": "/users",
          "matchPattern": "^/users$"
        },
        {
          "name": "/users/add",
          "route": "/users/add",
          "matchPattern": "^/users/add$"
        },
        {
          "name": "/users/edit",
          "route": "/users/edit",
          "matchPattern": "^/users/edit/[^/]*$"
        },
        {
          "name": "/users/view",
          "route": "/users/view",
          "matchPattern": "^/users/view/[^/]*$"
        },
        {
          "name": "/summary/rawMaterialByProvider/order",
          "route": "/summary/rawMaterialByProvider/order",
          "matchPattern": "^/summary/rawMaterialByProvider/order$"
        },
        {
          "name": "/summary/inventory/warehouse/rawMaterialByProvider",
          "route": "/summary/inventory/warehouse/rawMaterialByProvider",
          "matchPattern": "^/summary/inventory/warehouse/rawMaterialByProvider$"
        },
        {
          "name": "/summary/inventory/factory/rawMaterial",
          "route": "/summary/inventory/factory/rawMaterial",
          "matchPattern": "^/summary/inventory/factory/rawMaterial$"
        },
        {
          "name": "/summary/inventory/factory/finishedProduct",
          "route": "/summary/inventory/factory/finishedProduct",
          "matchPattern": "^/summary/inventory/factory/finishedProduct$"
        },
        {
          "name": "/summary/productForSale/store/order",
          "route": "/summary/productForSale/store/order",
          "matchPattern": "^/summary/productForSale/store/order$"
        },
        {
          "name": "/summary/inventory/store/productForSale",
          "route": "/summary/inventory/store/productForSale",
          "matchPattern": "^/summary/inventory/store/productForSale$"
        },
        {
          "name": "/store/sales/history",
          "route": "/store/sales/history",
          "matchPattern": "^/store/sales/history/[^/]*$"
        },
        {
          "name": "/store/sales/history/view",
          "route": "/store/sales/history/view",
          "matchPattern": "^/store/sales/history/view/[^/]*$"
        },
        {
          "name": "/store/sales/create",
          "route": "/store/sales/create",
          "matchPattern": "^/store/sales/create[^/]*$"
        },
        {
          "name": "/store/sales/history/edit",
          "route": "/store/sales/history/edit",
          "matchPattern": "^/store/sales/history/edit/[^/]*$"
        },
        {
          "name": "/store/sales/summary",
          "route": "/store/sales/summary",
          "matchPattern": "^/store/sales/summary$"
        },
        {
          "name": "/activityLog/view",
          "route": "/activityLog/view",
          "matchPattern": "^/activityLog/view/[^/]*$"
        },
        {
          "name": "/cashClosing",
          "route": "/cashClosing",
          "matchPattern": "^/cashClosing/[^/]*$"
        },
        {
          "name": "/cashClosing/view",
          "route": "/cashClosing/view",
          "matchPattern": "^/cashClosing/view/[^/]*$"
        },
        {
          "name": "/cashClosing/create",
          "route": "/cashClosing/create",
          "matchPattern": "^/cashClosing/create/[^/]*$"
        },
        {
          "name": "/cashClosing/edit",
          "route": "/cashClosing/edit",
          "matchPattern": "^/cashClosing/edit/[^/]*$"
        }
      ]');
